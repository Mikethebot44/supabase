import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import { defaultLexical } from './fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

import { Authors } from './collections/Authors'
import { Categories } from './collections/Categories'
import { Customers } from './collections/Customers'
import { Events } from './collections/Events'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { Archive } from './blocks/ArchiveBlock/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const siteName = 'Supabase'

const generateTitle = ({ doc, collectionConfig }: { doc: any; collectionConfig: any }) => {
  if (!collectionConfig) return doc.title || ''
  const collectionSlug = collectionConfig.slug
  switch (collectionSlug) {
    case 'customers':
      return `${doc.name} | ${siteName} Customer Stories`
    case 'events':
      return `${doc.title} | ${siteName} Events`
    case 'posts':
      return doc.title
    default:
      return `${doc.title} | ${siteName}`
  }
}

const generateURL = ({ doc }: { doc: any }) => {
  const url = getServerSideURL()
  return doc?.slug ? `${url}/${doc.slug}` : url
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  collections: [Authors, Categories, Customers, Events, Media, Posts, Tags, Users],
  blocks: [Archive],
  editor: defaultLexical,
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  cors: [getServerSideURL()].filter(Boolean),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    schemaName: 'cms-payload',
  }),
  sharp,
  plugins: [
    nestedDocsPlugin({
      collections: ['categories'],
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
    }),
    seoPlugin({
      generateTitle: ({ doc, collectionConfig }) => generateTitle({ doc, collectionConfig }),
      generateURL,
    }),
    payloadCloudPlugin(),
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
        },
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
      },
    }),
  ],
})
