const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Token ausente." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET não configurado no servidor." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, email, iat, exp ... }
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}

module.exports = requireAuth;