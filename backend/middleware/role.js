// გამოყენება: authorize('admin') ან authorize('admin', 'manager')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error('წვდომა აკრძალულია - არასაკმარისი უფლებები'));
    }
    next();
  };
};

module.exports = { authorize };
