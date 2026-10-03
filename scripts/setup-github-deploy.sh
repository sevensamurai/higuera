#!/usr/bin/env bash
# One-time Google Cloud setup so GitHub Actions can deploy without a stored key (Workload Identity
# Federation). Run it yourself, signed in with `gcloud auth login` as an owner of the project.
#
#   scripts/setup-github-deploy.sh <firebase-project-id> <github-owner/repo>
#
# Safe to re-run: existing resources are left as they are. It creates:
#   - service account  github-deployer   with only the roles a Hosting + Firestore-rules deploy needs
#   - identity pool    github            trusting GitHub's OIDC tokens
#   - provider         github            accepting only <owner/repo> on the main branch
# and prints the two values to store as GitHub repository variables.
set -euo pipefail

PROJECT_ID="${1:?usage: $0 <firebase-project-id> <github-owner/repo>}"
REPO="${2:?usage: $0 <firebase-project-id> <github-owner/repo>}"
SA_NAME=github-deployer
SA="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
POOL=github
PROVIDER=github

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
echo "Project $PROJECT_ID ($PROJECT_NUMBER), repository $REPO"

echo "→ Enabling APIs"
gcloud services enable --project "$PROJECT_ID" \
  iamcredentials.googleapis.com sts.googleapis.com \
  firebasehosting.googleapis.com firebaserules.googleapis.com firestore.googleapis.com

echo "→ Service account $SA"
if ! gcloud iam service-accounts describe "$SA" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" --display-name "GitHub Actions deploys"
fi
for role in \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/firebase.viewer \
  roles/serviceusage.serviceUsageConsumer \
  roles/serviceusage.apiKeysViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role "$role" \
    --condition None --quiet >/dev/null
  echo "   granted $role"
done

echo "→ Workload identity pool and provider"
if ! gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT_ID" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT_ID" --location global \
    --display-name "GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT_ID" --location global \
     --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT_ID" --location global \
    --workload-identity-pool "$POOL" --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$REPO' && assertion.ref == 'refs/heads/main'"
fi

echo "→ Allowing $REPO to act as the service account"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" \
  --quiet >/dev/null

cat <<OUT

Done. Add these GitHub repository variables (Settings → Secrets and variables → Actions → Variables),
or run the gh commands below:

  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo $REPO --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
  gh variable set GCP_SERVICE_ACCOUNT            --repo $REPO --body "$SA"
  gh variable set FIREBASE_PROJECT_ID            --repo $REPO --body "$PROJECT_ID"

Plus the web app config from Firebase console → Project settings → Your apps:
  VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_APP_ID, and optionally VITE_APP_NAME.
OUT
