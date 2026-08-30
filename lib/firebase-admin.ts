import {
	applicationDefault,
	cert,
	getApps,
	initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
	configureFirebaseAdminEmulators,
	isFirebaseEmulatorEnvironment,
	localFirebaseProjectId,
} from "@/lib/firebase-environment";

configureFirebaseAdminEmulators();

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? process.env.GCP_CLIENT_EMAIL;
const privateKey = (
	process.env.FIREBASE_PRIVATE_KEY ?? process.env.GCP_PRIVATE_KEY
)?.replace(/\\n/g, "\n");

const firebaseAdmin =
	getApps().length > 0
		? getApps()[0]
		: initializeApp({
				projectId: isFirebaseEmulatorEnvironment
					? localFirebaseProjectId
					: projectId,
				credential: isFirebaseEmulatorEnvironment
					? applicationDefault()
					: cert({
							projectId,
							clientEmail,
							privateKey,
						}),
			});

export const adminAuth = getAuth(firebaseAdmin);
