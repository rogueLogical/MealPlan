const request = require('supertest');
const app = require('../server');

describe('Core API Tests', () => {
  it('should return 200 status verification on health route access', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toEqual('UP');
  });
});
