export class AuthController {
  constructor(authService) { this.authService = authService; }

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      res.json({ ok: true, ...result });
    } catch (error) { next(error); }
  };
}
