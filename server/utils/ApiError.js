export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.expose = true;
    if (code) this.code = code;
  }
}
