export function validate(schema, property = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);

    if (!result.success) {
      const error = new Error("Request validation failed");
      error.statusCode = 400;
      error.details = result.error.issues;
      return next(error);
    }

    req[property] = result.data;
    return next();
  };
}
