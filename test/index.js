import test from 'ava'
import { fileURLToPath } from 'url'

import netlifyBuild from '@netlify/build';
import { promises as fs } from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { onPostBuild } from '../src/index.js';
import { transformSrcURL, isRemoteURL } from '../src/lib/imageengine.js';

const NETLIFY_CONFIG = fileURLToPath(
  new URL('../netlify.toml', import.meta.url),
)
const __dirname = process.cwd()
const mocksPath = path.join(__dirname, 'test/mock');
const tempPath = path.join(mocksPath, 'temp_url');
const tempPath1 = path.join(mocksPath,"temp_directives")
const tempPath2 = path.join(mocksPath, 'temp_srcset')


async function mkdir(directoryPath) {
  let dir;
  console.log('directoryPath', directoryPath)
  try {
    dir = await fs.stat(directoryPath);
  } catch(e) {}
  if ( dir && dir.isDirectory() ) return;
  await fs.mkdir(directoryPath);
}

test('Netlify Build should not fail', async (t) => {

  const { success, logs } = await netlifyBuild({
    config: NETLIFY_CONFIG,
    buffer: true,
  })

  // Netlify Build output
  console.log(
    [logs.stdout.join('\n'), logs.stderr.join('\n')]
      .filter(Boolean)
      .join('\n\n'),
  )

  // Check that build succeeded
  t.true(success)
})

test('Netlify Build should replace URL', async (t) => {
  const mockFiles = (await fs.readdir(mocksPath)).filter(filePath => filePath.includes('.html'));
  await mkdir(tempPath);
  await Promise.all(mockFiles.map(async file => {
    await fs.copyFile(path.join(mocksPath, file), path.join(tempPath, file));
  }))
  process.env.URL = "https://netlify-plugin-imageengine.netlify.app"
  let deliveryAddress = "test.imageengine.io"
  await onPostBuild({
    constants: {
      PUBLISH_DIR: tempPath
    },
    inputs: {
      deliveryAddress,
    },
  })
  const files = await fs.readdir(tempPath);

  await Promise.all(files.map(async file => {
    const data = await fs.readFile(path.join(tempPath, file), 'utf-8');
    const dom = new JSDOM(data);
    const images = Array.from(dom.window.document.querySelectorAll('img'));
    images.forEach(image => {
      t.is(image.getAttribute('src').includes(deliveryAddress),true);
    })
    fs.rm(tempPath, { recursive: true, force: true });    
  }));
})

test('Netlify Build should add directives if specified', async (t) => {
  const mockFiles = (await fs.readdir(mocksPath)).filter(filePath => filePath.includes('.html'));
  await mkdir(tempPath1);
  await Promise.all(mockFiles.map(async file => {
    await fs.copyFile(path.join(mocksPath, file), path.join(tempPath1, file));
  }))
  process.env.URL = "https://netlify-plugin-imageengine.netlify.app"
  let deliveryAddress = "test.imageengine.io"
  let directives = {
    height: 600,
    width: 700
  }
  await onPostBuild({
    constants: {
      PUBLISH_DIR: tempPath1
    },
    inputs: {
      deliveryAddress,
      directives
    },
  })
  const files = await fs.readdir(tempPath1);

  await Promise.all(files.map(async file => {
    const data = await fs.readFile(path.join(tempPath1, file), 'utf-8');
    const dom = new JSDOM(data);
    const images = Array.from(dom.window.document.querySelectorAll('img'));
    images.forEach(image => {
      t.is(image.getAttribute('src').includes(deliveryAddress),true);
      t.is(image.getAttribute('src').includes(`h_${directives.height}/w_${directives.width}`),true);
    })
    fs.rm(tempPath1, { recursive: true, force: true });    
  }));
})

test('Netlify Build handles srcset attributes', async (t) => {
  const mockFiles = (await fs.readdir(mocksPath)).filter(filePath => filePath.includes('.html'));
  await mkdir(tempPath2);
  await Promise.all(mockFiles.map(async file => {
    await fs.copyFile(path.join(mocksPath, file), path.join(tempPath2, file));
  }))
  
  const htmlContent = `
    <img src="image1.jpg" srcset="image1-small.jpg 300w, image1-large.jpg 1000w">
    <img src="https://example.com/image2.jpg" srcset="https://example.com/image2-small.jpg 300w, https://example.com/image2-large.jpg 1000w">
  `;
  
  await fs.writeFile(path.join(tempPath2, 'test.html'), htmlContent);
  
  process.env.URL = "https://netlify-plugin-imageengine.netlify.app"
  let deliveryAddress = "test.imageengine.io"
  
  await onPostBuild({
    constants: {
      PUBLISH_DIR: tempPath2
    },
    inputs: {
      deliveryAddress
    },
  })
  
  const updatedHtml = await fs.readFile(path.join(tempPath2, 'test.html'), 'utf-8');
  const dom = new JSDOM(updatedHtml);
  const images = Array.from(dom.window.document.querySelectorAll('img'));
  
  images.forEach(image => {
    t.true(image.getAttribute('src').includes(deliveryAddress));
    const srcset = image.getAttribute('srcset');
    t.truthy(srcset);
    srcset.split(',').forEach(src => {
      t.true(src.trim().split(' ')[0].includes(deliveryAddress));
    });
  });

  fs.rm(tempPath2, { recursive: true, force: true });
});


test('transformSrcURL handles remote URLs correctly', t => {
  const deliveryAddress = 'test.imageengine.io';
  
  t.is(transformSrcURL('https://example.com/image.jpg', deliveryAddress), 'https://test.imageengine.io/image.jpg');
  t.is(transformSrcURL('http://example.com/image.jpg', deliveryAddress), 'http://test.imageengine.io/image.jpg');
  t.is(transformSrcURL('//example.com/image.jpg', deliveryAddress), '//test.imageengine.io/image.jpg');
});

test('transformSrcURL handles non-remote URLs correctly', t => {
  const deliveryAddress = 'test.imageengine.io';
  
  t.is(transformSrcURL('/images/local.jpg', deliveryAddress), '//test.imageengine.io/images/local.jpg');
  t.is(transformSrcURL('images/local.jpg', deliveryAddress), '//test.imageengine.io/images/local.jpg');
});

test('isRemoteURL correctly identifies remote and non-remote URLs', t => {
  t.true(isRemoteURL('https://example.com/image.jpg'));
  t.true(isRemoteURL('http://example.com/image.jpg'));
  t.true(isRemoteURL('//example.com/image.jpg'));
  t.false(isRemoteURL('/images/local.jpg'));
  t.false(isRemoteURL('images/local.jpg'));
});