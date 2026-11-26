export class AuthController {
  constructor(authService) { this.authService = authService; }

  login = async (req, res, next) => {
    try {
      const { login, password } = req.body;
      const result = await this.authService.login(login, password);
      res.json({ success: true, data: result, message: 'Sesión iniciada.' });
    } catch (error) { next(error); }
  };

  me = async (req, res, next) => {
    try {
      const user = await this.authService.me(req.user.sub);
      res.json({ success: true, data: user, message: 'Sesión vigente.' });
    } catch (error) { next(error); }
  };
}
