const jwt = require("jsonwebtoken");

module.exports = function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token ausente." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET não configurado no servidor." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // payload do seu login: { sub: user.id, email: user.email }
    req.user = payload;
    req.userId = payload.sub;
    req.userEmail = payload.email;

    return next();
  } catch (e) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};