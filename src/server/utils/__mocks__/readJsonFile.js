/*
 * Copyright 2019 American Express Travel Related Services Company, Inc.
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

export default function readJsonFile(filePath) {
  switch (filePath.split('/').pop()) {
    case '.build-meta.json': {
      const chunks = {
        app: 'app.js',
        'app~vendors': 'app~vendors.js',
        'i18n/en': 'i18n/en.js',
        'i18n/en-US': 'i18n/en-US.js',
        'i18n/es-MX': 'i18n/es-MX.js',
        'i18n/fr-CA': ['i18n/fr-CA.js', 'i18n/fr-CA.js.map'],
        'i18n/tk-TM': 'i18n/tk-TM.js',
        'i18n/am': ['i18n/am.js', 'i18n/am.js.map'],
        'i18n/bs~i18n/bs-Cyrl~i18n/bs-Cyrl-BA~i18n/bs-Latn~i18n/bs-Latn-BA': [
          'i18n/bs~i18n/bs-Cyrl~i18n/bs-Cyrl-BA~i18n/bs-Latn~i18n/bs-Latn-BA.js',
          'i18n/bs~i18n/bs-Cyrl~i18n/bs-Cyrl-BA~i18n/bs-Latn~i18n/bs-Latn-BA.js.map',
        ],
        runtime: 'runtime.js',
        vendors: ['vendors.js', 'vendors.js.map'],
      };
      return {
        buildVersion: '1.2.3-rc.4-abc123',
        modernBrowserChunkAssets: chunks,
        // the build output mirrors the modern chunk assets as of today
        legacyBrowserChunkAssets: chunks,
      };
    }
    case 'bundle.integrity.manifest.json':
      return {
        'app.js': '123',
        'app~vendors.js': '456',
        'runtime.js': '789',
        'vendors.js': '101112',
        'legacy/app.js': 'abc',
        'legacy/app~vendors.js': 'def',
        'legacy/runtime.js': 'ghi',
        'legacy/vendors.js': 'jkl',
      };
    default:
      throw new Error('Couldn\'t find JSON file to read');
  }
}
