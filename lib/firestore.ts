import { Firestore } from '@google-cloud/firestore';
import {
  configureFirebaseAdminEmulators,
  isFirebaseEmulatorEnvironment,
  localFirebaseProjectId,
} from '@/lib/firebase-environment';

configureFirebaseAdminEmulators();

const db = new Firestore(
  isFirebaseEmulatorEnvironment
    ? { projectId: localFirebaseProjectId }
    : {
        projectId: process.env.GCP_PROJECT_ID,
        credentials: {
          client_email: process.env.GCP_CLIENT_EMAIL,
          private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
      }
);

export { db };
