import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Smoke test for the whole HTTP stack (routing, global guards, global pipes). Requires
 * a real Postgres + Redis reachable via the same env vars the app itself uses (.env) -
 * point it at a disposable/test database, not production data, per CLAUDE.md's local
 * setup instructions.
 */
describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/branches is public and returns an array', () => {
    return request(app.getHttpServer())
      .get('/api/v1/branches')
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /api/v1/users is protected and rejects an unauthenticated request', () => {
    return request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('POST /api/v1/auth/login rejects an unknown account', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '0000000000', password: 'wrong-password' })
      .expect(401);
  });
});
