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

const firebaseAdmin =
	getApps().length > 0
		? getApps()[0]
		: initializeApp({
				projectId: isFirebaseEmulatorEnvironment
					? localFirebaseProjectId
					: process.env.FIREBASE_PROJECT_ID,
				credential: isFirebaseEmulatorEnvironment
					? applicationDefault()
					: cert({
							projectId: process.env.FIREBASE_PROJECT_ID,
							clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
							privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
						}),
			});

export const adminAuth = getAuth(firebaseAdmin);
