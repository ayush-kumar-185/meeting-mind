function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      const path = firstError.path.join('.');
      const prefix = path ? `${path}: ` : '';
      return res.status(400).json({
        error: `${prefix}${firstError.message}`,
      });
    }
    req.body = result.data; // use the parsed/coerced data going forward
    next();
  };
}

module.exports = validate;
