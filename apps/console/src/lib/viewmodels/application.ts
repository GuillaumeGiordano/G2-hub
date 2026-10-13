/** A row of the applications list of the active organization. */
export type ApplicationListItem = {
	id: string;
	name: string;
	slug: string;
	allowedOrigins: string[];
	createdAt: Date;
};
