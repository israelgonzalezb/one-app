/*
 * Copyright 2020 American Express Travel Related Services Company, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import request from 'supertest';
import express from 'express';

import createPWARouter from '../../../src/server/routes/pwa';
import { configurePWA } from '../../../src/server/middleware/pwa/config';
import {
  createServiceWorkerEscapeHatchScript,
  createServiceWorkerNoopScript,
  createServiceWorkerScript,
} from '../../../src/server/middleware/pwa/service-worker';
import routes from '../../../src/server/config/routes';

jest.mock('fs', () => ({
  readFileSync: (filePath) => ({ toString: () => (filePath.endsWith('noop.js') ? '[service-worker-noop-script]' : '[service-worker-script]') }),
}));

const defaultMatchAll = jest.fn((req, res) => {
  res
    .status(404)
    .set('Content-Type', 'text/html')
    .send('<!doctype>');
});

const makeGetFrom = (app) => (url) => new Promise((resolve, reject) => {
  request(app)
    .get(url)
    .end((err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
});

describe('PWA router', () => {
  const workerPath = [routes.pwa.prefix, routes.pwa.worker].join('');
  const manifestPath = [routes.pwa.prefix, routes.pwa.manifest].join('');
  const mockWorker = createServiceWorkerScript();
  const mockNoopWorker = createServiceWorkerNoopScript();
  const mockEscapeHatchWorker = createServiceWorkerEscapeHatchScript();
  const mockServiceWorkerScope = '/nested/scope';
  const mockManifest = {
    name: 'One App',
    short_name: 'one-app',
  };

  beforeEach(() => jest.clearAllMocks());
  beforeAll(() => {
    configurePWA({
      enabled: true,
      manifest: mockManifest,
    });
  });

  const app = express()
    .use(routes.pwa.prefix, createPWARouter())
    .get('*', defaultMatchAll);
  const get = makeGetFrom(app);

  [
    [workerPath, 'application/javascript; charset=utf-8', mockWorker],
    [manifestPath, 'application/manifest+json; charset=utf-8', JSON.stringify(mockManifest)],
  ].forEach((pair) => {
    const [route, contentType, mockResponse] = pair;

    it(`should respond with a status of 200 at ${route}`, async () => {
      expect.assertions(3);
      const response = await get(route);
      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('content-type', contentType);
      expect(response.text).toBe(mockResponse);
    });
  });

  describe('disabled', () => {
    beforeAll(() => {
      configurePWA({
        enabled: false,
      });
    });

    [
      [workerPath, 404],
      [manifestPath, 404],
    ].forEach((pair) => {
      const [route, status] = pair;

      it(`should respond with a status of ${status} when disabled at ${route}`, async () => {
        expect.assertions(1);
        const response = await get(route);
        expect(response.status).toBe(status);
      });
    });
  });

  describe('noop worker', () => {
    beforeAll(() => {
      configurePWA({
        noop: true,
      });
    });

    [
      [workerPath, 'application/javascript; charset=utf-8', mockNoopWorker],
    ].forEach((pair) => {
      const [route, contentType, mockResponse] = pair;

      it(`should respond with a noop worker at ${route}`, async () => {
        expect.assertions(3);
        const response = await get(route);
        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('content-type', contentType);
        expect(response.text).toBe(mockResponse);
      });
    });
  });

  describe('escape hatch worker', () => {
    beforeAll(() => {
      configurePWA({
        escapeHatch: true,
      });
    });

    [
      [workerPath, 'application/javascript; charset=utf-8', mockEscapeHatchWorker],
    ].forEach((pair) => {
      const [route, contentType, mockResponse] = pair;

      it(`should respond with a status of 404 when disabled at ${route}`, async () => {
        expect.assertions(3);
        const response = await get(route);
        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('content-type', contentType);
        expect(response.text).toBe(mockResponse);
      });
    });
  });

  describe('setting scope', () => {
    beforeAll(() => {
      configurePWA({
        enabled: true,
        scope: mockServiceWorkerScope,
      });
    });

    [
      [workerPath, mockServiceWorkerScope, mockWorker],
    ].forEach((pair) => {
      const [route, mockedScope, mockResponse] = pair;

      it(`should respond with a status of 404 when disabled at ${route}`, async () => {
        expect.assertions(3);
        const response = await get(route);
        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('service-worker-allowed', mockedScope);
        expect(response.text).toBe(mockResponse);
      });
    });
  });
});
