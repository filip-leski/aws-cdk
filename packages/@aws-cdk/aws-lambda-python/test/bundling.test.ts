import * as path from 'path';
import { Architecture, Code, Runtime } from '@aws-cdk/aws-lambda';
import { DockerImage } from '@aws-cdk/core';
import { Bundling } from '../lib/bundling';

jest.spyOn(Code, 'fromAsset');
jest.spyOn(DockerImage, 'fromBuild');

jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => {
    return {
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('sha256:1234567890abcdef'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    };
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('Bundling a function without dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler-nodeps');
  Bundling.bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_7,
    architecture: Architecture.X86_64,
  });

  // Correctly bundles
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'cp -R /asset-input /asset-output',
      ],
    }),
  }));

  expect(DockerImage.fromBuild).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '../lib')), expect.objectContaining({
    buildArgs: expect.objectContaining({
      IMAGE: expect.stringMatching(/build-python/),
    }),
    platform: 'linux/amd64',
  }));
});

test('Bundling a function with requirements.txt', () => {
  const entry = path.join(__dirname, 'lambda-handler');
  Bundling.bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_7,
    architecture: Architecture.X86_64,
  });

  // Correctly bundles
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'python -m pip install -r requirements.txt -t /asset-output && cp -R /asset-input /asset-output',
      ],
    }),
  }));
});

test('Bundling Python 2.7 with requirements.txt installed', () => {
  const entry = path.join(__dirname, 'lambda-handler');
  Bundling.bundle({
    entry: entry,
    runtime: Runtime.PYTHON_2_7,
    architecture: Architecture.X86_64,
  });

  // Correctly bundles with requirements.txt pip installed
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'python -m pip install -r requirements.txt -t /asset-output && cp -R /asset-input /asset-output',
      ],
    }),
  }));
});

test('Bundling a layer with dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler');

  Bundling.bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_9,
    architecture: Architecture.X86_64,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'python -m pip install -r requirements.txt -t /asset-output/python && cp -R /asset-input /asset-output/python',
      ],
    }),
  }));
});

test('Bundling a python code layer', () => {
  const entry = path.join(__dirname, 'lambda-handler-nodeps');

  Bundling.bundle({
    entry: path.join(entry, '.'),
    runtime: Runtime.PYTHON_3_9,
    architecture: Architecture.X86_64,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'cp -R /asset-input /asset-output/python',
      ],
    }),
  }));
});

test('Bundling a function with pipenv dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler-pipenv');

  Bundling.bundle({
    entry: path.join(entry, '.'),
    runtime: Runtime.PYTHON_3_9,
    architecture: Architecture.X86_64,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'PIPENV_VENV_IN_PROJECT=1 pipenv lock -r > requirements.txt && rm -rf .venv && python -m pip install -r requirements.txt -t /asset-output/python && cp -R /asset-input /asset-output/python',
      ],
    }),
  }));
});

test('Bundling a function with poetry dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler-poetry');

  Bundling.bundle({
    entry: path.join(entry, '.'),
    runtime: Runtime.PYTHON_3_9,
    architecture: Architecture.X86_64,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'poetry export --with-credentials --format requirements.txt --output requirements.txt && python -m pip install -r requirements.txt -t /asset-output/python && cp -R /asset-input /asset-output/python',
      ],
    }),
  }));
});

test('Bundling a function with custom bundling image', () => {
  const entry = path.join(__dirname, 'lambda-handler-custom-build');
  const image = DockerImage.fromBuild(path.join(entry));

  Bundling.bundle({
    entry: path.join(entry, '.'),
    runtime: Runtime.PYTHON_3_9,
    architecture: Architecture.X86_64,
    outputPathSuffix: 'python',
    image,
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      image,
      command: [
        'bash', '-c',
        'python -m pip install -r requirements.txt -t /asset-output/python && cp -R /asset-input /asset-output/python',
      ],
    }),
  }));

  expect(DockerImage.fromBuild).toHaveBeenCalledWith(expect.stringMatching(entry));
});

test('Bundling with custom build args', () => {
  const entry = path.join(__dirname, 'lambda-handler');
  const testPypi = 'https://test.pypi.org/simple/';
  Bundling.bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_7,
    buildArgs: { PIP_INDEX_URL: testPypi },
  });

  expect(DockerImage.fromBuild).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '../lib')), expect.objectContaining({
    buildArgs: expect.objectContaining({
      PIP_INDEX_URL: testPypi,
    }),
  }));
});
