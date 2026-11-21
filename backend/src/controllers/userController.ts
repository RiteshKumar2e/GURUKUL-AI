import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository';
import { authService } from '../services/authService';
import { badRequest, notFound } from '../utils/errors';
import { authController } from './authController';

export const userController = {
  async me(req: Request, res: Response) {
    const user = await userRepository.findPublicById(req.user!.id);
    if (!user) throw notFound('Account not found.');
    res.json({ user });
  },
  async update(req: Request, res: Response) {
    res.json({ user: await userRepository.update(req.user!.id, req.body) });
  },
  async changePassword(req: Request, res: Response) {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    authController.clearCookie(res);
    res.json({ ok: true, message: 'Password changed. Please sign in again on your other devices.' });
  },
  /** Permanently deletes the account and all learning data (cascade). */
  async remove(req: Request, res: Response) {
    const user = await userRepository.findById(req.user!.id);
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw badRequest('Password is incorrect.');
    await userRepository.delete(user.id);
    authController.clearCookie(res);
    res.status(204).end();
  },
};
