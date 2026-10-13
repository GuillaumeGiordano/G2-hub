/** A row of the applications list of the active organization. */
export type ApplicationListItem = {
	id: string;
	name: string;
	slug: string;
	allowedOrigins: string[];
	createdAt: Date;
	/** Files its site uploaded through the API — lost if the application is deleted (§22). */
	siteFileCount: number;
};
