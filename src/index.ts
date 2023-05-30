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
    containerAccessType?: 'private' | 'blob' | 'container'
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
        const containerClient = getContainerClient(blobServiceClient, config)
        containerClient.createIfNotExists({ access: config.containerAccessType == 'private' ? undefined : config.containerAccessType })
            .then((response) => console.log(`container ${config.containerName} ${response.succeeded ? 'created successfully' : 'already existed'}`))
    }

    return blobServiceClient
}

function getContainerClient(blobServiceClient: BlobServiceClient, config: Config) {
    return blobServiceClient.getContainerClient(config.containerName)
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
    const containerClient = getContainerClient(blobSvcClient, config)
    const filename = getFileName(config.defaultPath, file)
    const client = containerClient.getBlockBlobClient(filename)
    const options = {
        blobHTTPHeaders: { blobContentType: file.mime },
    }

    const url = config.containerAccessType === 'private' ? 
        await client.generateSasUrl({
            permissions: BlobSASPermissions.from({ read: true }),
            expiresOn: new Date(3000, 0),
        }) : client.url

    file.url = config.cdnBaseURL ? url.replace(config.serviceBaseURL!, config.cdnBaseURL) : url
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
            containerAccessType: config.containerAccessType,
            serviceBaseURL: trimParam(config.serviceBaseURL) || `https://${trimParam(config.account)}.blob.core.windows.net`,
        }

        const blobSvcClient = makeBlobServiceClient(config)
        return {
            upload(file: StrapiFile) {
                return handleUpload(config, blobSvcClient, file)
            },
            uploadStream(file: StrapiFile) {
                return handleUpload(config, blobSvcClient, file)
            },
            delete(file: StrapiFile) {
                return handleDelete(config, blobSvcClient, file)
            },
        }
    },
}
