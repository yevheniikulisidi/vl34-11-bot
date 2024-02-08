import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class NotFoundMiddleware implements NestMiddleware {
  use(_req: Request, res: Response) {
    res.render('not-found');
  }
}
