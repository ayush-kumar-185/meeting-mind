function validateObjectIdParam(paramName) {
  return (req, res, next) => {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params[paramName])) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    next();
  };
}

module.exports = validateObjectIdParam;
