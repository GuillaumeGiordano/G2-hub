/** Rows per page of the console lists, and the choices offered by the pager. */
export const DEFAULT_PER_PAGE = 20;
export const PER_PAGE_OPTIONS = [20, 50, 100];

/** A console account's password reset link (e-mailed) stays valid this long. */
export const CONSOLE_PASSWORD_RESET_VALID_MINUTES = 60;

/** A console account's invitation link (e-mailed when an Admin adds a member) stays valid this long. */
export const CONSOLE_INVITATION_VALID_DAYS = 7;

/** A sign-up confirmation link (e-mailed, DECISIONS.md §45) stays valid this long. */
export const SIGNUP_LINK_VALID_HOURS = 24;

/** A signed-up account never confirmed (and in no organization) is removed after this long. */
export const UNCONFIRMED_SIGNUP_DAYS = 7;
