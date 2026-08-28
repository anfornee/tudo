export const isFirebaseEmulatorEnvironment =
	process.env.NODE_ENV === "development";

export const localFirebaseProjectId = "tudo-local";

export function configureFirebaseAdminEmulators() {
	if (!isFirebaseEmulatorEnvironment) {
		return;
	}

	process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
	process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
	process.env.STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
	process.env.GCLOUD_PROJECT ??= localFirebaseProjectId;
}
