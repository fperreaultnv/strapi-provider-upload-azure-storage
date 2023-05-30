import { BlobSASPermissions, BlobServiceClient, newPipeline, StorageSharedKeyCredential } from '@azure/storage-blob'
import internal from 'stream'

type Config = {
    account: string
    accountKey: string
    serviceBaseURL?: string
    containerName: string
    defaultPath: string
    cdnBaseURL?: string
    createContainerIfNotExists?: boolean
}

type StrapiFile = File & {
    stream: internal.Readable
    hash: string
    url: string
    ext: string
    mime: string
    path: string
}

function trimParam(input?: string) {
    return typeof input === 'string' ? input.trim() : '';
}

function getFileName(path: string, file: StrapiFile) {
    return `${trimParam(path)}/${file.hash}${file.ext}`
}

function makeBlobServiceClient(config: Config) {
    const credential = new StorageSharedKeyCredential(config.account, config.accountKey)
    const pipeline = newPipeline(credential)
    const blobServiceClient = new BlobServiceClient(config.serviceBaseURL!, pipeline)
    if (config.createContainerIfNotExists!) {
        const containerClient = blobServiceClient.getContainerClient(config.containerName)
        containerClient.createIfNotExists()
            .then((response) => console.log(`container ${config.containerName} ${response.succeeded ? 'created successfully' : 'already existed'}`))
    }

    return blobServiceClient
}

const uploadOptions = {
    bufferSize: 4 * 1024 * 1024, // 4MB
    maxBuffers: 20,
}

async function handleUpload(
    config: Config,
    blobSvcClient: BlobServiceClient,
    file: StrapiFile
): Promise<void> {
    const containerClient = blobSvcClient.getContainerClient(config.containerName)
    const filename = getFileName(config.defaultPath, file)
    const client = containerClient.getBlockBlobClient(filename)
    const options = {
        blobHTTPHeaders: { blobContentType: file.mime },
    }

    file.url = config.cdnBaseURL ? client.url.replace(config.serviceBaseURL!, config.cdnBaseURL) : client.url

    await client.uploadStream(
        file.stream,
        uploadOptions.bufferSize,
        uploadOptions.maxBuffers,
        options
    )
}

async function handleDelete(
    config: Config,
    blobSvcClient: BlobServiceClient,
    file: StrapiFile
): Promise<void> {
    const containerClient = blobSvcClient.getContainerClient(config.containerName)
    const client = containerClient.getBlobClient(getFileName(config.defaultPath, file))
    await client.deleteIfExists()
    file.url = client.url
}

async function getSignedUrl(
    config: Config,
    blobSvcClient: BlobServiceClient,
    file: StrapiFile
): Promise<{ url: string }> {
    const containerClient = blobSvcClient.getContainerClient(config.containerName)
    const client = containerClient.getBlobClient(getFileName(config.defaultPath, file))
    
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + 1)

    // we can generate the sas url directly here because this getSignedUrl function won't be called by strapi if the container is not private.
    // see isPrivate() implementation and https://github.com/strapi/strapi/blob/4f63cb517f3c24b670a94c37d4fbe3ed2d2cb89b/packages/core/upload/server/services/file.js#L29
    const url = await client.generateSasUrl({
        permissions: BlobSASPermissions.from({ read: true }),
        expiresOn
    })

    return { url };
}

async function isPrivate(config: Config, blobSvcClient: BlobServiceClient): Promise<boolean> {
    const container = blobSvcClient.getContainerClient(config.containerName)
    if (await container.exists()) {
        const properties = await container.getProperties()
        return properties.blobPublicAccess === undefined
    } else if (config.createContainerIfNotExists!) {
        await container.createIfNotExists()
        return isPrivate(config, blobSvcClient)
    }

    throw new Error(`upload provider error : container ${config.containerName} does not exist. Either use createContainerIfNotExists or create the container manually in ${config.account} storage account.`);
}

module.exports = {
    provider: 'azure',
    auth: {
        account: {
            label: 'Account name (required)',
            type: 'text',
        },
        accountKey: {
            label: 'Secret access key (required)',
            type: 'text',
        },
        serviceBaseURL: {
            label: 'Base service URL to be used, optional. Defaults to https://${account}.blob.core.windows.net (optional)',
            type: 'text',
        },
        containerName: {
            label: 'Container name (required)',
            type: 'text',
        },
        defaultPath: {
            label: 'The path to use when there is none being specified (required)',
            type: 'text',
        },
        cdnBaseURL: {
            label: 'CDN base url (optional)',
            type: 'text',
        },
        createContainerIfNotExists: {
            label: "An option to create the container automatically if it doesn't exist. If this is false, the container must be created manually.",
            type: 'bool',
        },
        containerAccessType: {
            label: "One of 'private', 'container', or 'blob'. The container access type that will be used upon container creation. Not used if 'createContainerIfNotExists' is false. Defaults to private.",
            type: 'text',
        }
    },
    init: (config: Config) => {
        config = {
            containerName: trimParam(config.containerName),
            account: trimParam(config.account),
            accountKey: trimParam(config.accountKey),
            createContainerIfNotExists: config.createContainerIfNotExists === undefined ? true : config.createContainerIfNotExists,
            defaultPath: trimParam(config.defaultPath),
            cdnBaseURL: trimParam(config.cdnBaseURL),
            serviceBaseURL: trimParam(config.serviceBaseURL) || `https://${trimParam(config.account)}.blob.core.windows.net`,
        }

        const blobSvcClient = makeBlobServiceClient(config)
        return {
            async upload(file: StrapiFile) {
                await handleUpload(config, blobSvcClient, file)
            },
            async uploadStream(file: StrapiFile) {
                await handleUpload(config, blobSvcClient, file)
            },
            async delete(file: StrapiFile) {
                await handleDelete(config, blobSvcClient, file)
            },
            async getSignedUrl(file: StrapiFile) {
                return await getSignedUrl(config, blobSvcClient, file)
            },
            async isPrivate() {
                return await isPrivate(config, blobSvcClient)
            }
        }
    },
}
