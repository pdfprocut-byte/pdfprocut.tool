export const notFound = (req, res) => res.status(404).json({ success: false, error: 'Route not found' });

export const errorHandler = (err, req, res, next) => {
  const isMulterError = err.name === 'MulterError';
  const status = err.status || err.statusCode || (isMulterError ? err.code === 'LIMIT_FILE_SIZE' ? 413 : 400 : err.name === 'ValidationError' ? 400 : 500);
  if (process.env.NODE_ENV !== 'test') {
    const logDetail = process.env.NODE_ENV === 'production' ? err.name : err.message;
    console.error(`${status}: ${logDetail}`);
  }

  let message = err.expose ? err.message : status >= 500 ? 'Processing failed. Please try again.' : err.message;
  if (isMulterError) {
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'A file is larger than the allowed upload size.'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Too many files were included in this upload.'
        : err.code === 'LIMIT_FIELD_COUNT' || err.code === 'LIMIT_PART_COUNT'
          ? 'Too many form fields were included in this upload.'
          : 'The upload format or fields are invalid.';
  }

  const body = { success: false, error: message };
  if (err.code && !isMulterError) body.code = err.code;
  res.status(status).json(body);
};
