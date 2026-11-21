import { Router } from 'express';
import { authController } from '../controllers/authController';
import { userController } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/security';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/errors';
import { changePasswordSchema, deleteAccountSchema, loginSchema, registerSchema, updateUserSchema } from '../validators';

export const authRouter = Router();
authRouter.post('/register', authLimiter, validate(registerSchema), h(authController.register));
authRouter.post('/login', authLimiter, validate(loginSchema), h(authController.login));
authRouter.post('/refresh', h(authController.refresh));
authRouter.post('/logout', h(authController.logout));
authRouter.get('/me', requireAuth, h(authController.me));

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/me', h(userController.me));
usersRouter.patch('/me', validate(updateUserSchema), h(userController.update));
usersRouter.post('/me/password', authLimiter, validate(changePasswordSchema), h(userController.changePassword));
usersRouter.delete('/me', authLimiter, validate(deleteAccountSchema), h(userController.remove));
