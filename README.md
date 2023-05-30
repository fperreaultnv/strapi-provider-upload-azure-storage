# Strapi Provider Upload Azure Storage

[![NpmVersion](https://img.shields.io/npm/v/strapi-provider-upload-private-azure-storage.svg)](https://www.npmjs.com/package/strapi-provider-upload-private-azure-storage) [![NpmDownloads](https://img.shields.io/npm/dt/strapi-provider-upload-private-azure-storage.svg)](https://www.npmjs.com/package/strapi-provider-upload-private-azure-storage)

## Overview

This repo is a fork from original [strapi-provider-upload-azure-storage](https://github.com/jakeFeldman/strapi-provider-upload-azure-storage) repo.

Plugin enabling image uploading to private azure storage container from strapi.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.


### Prerequisites

- strapi@4.0.0+

### Installing

Inside your strapi project run the following

```sh
yarn add strapi-provider-upload-private-azure-storage

# or

npm install strapi-provider-upload-private-azure-storage
```

## Usage

To enable the provider, create or edit the file at `./config/plugins.js`.

This is an example `plugins.js` file for Azure storage:

```js
module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-upload-private-azure-storage",
      providerOptions: {
        account: env("STORAGE_ACCOUNT"),
        accountKey: env("STORAGE_ACCOUNT_KEY"),
        serviceBaseURL: env("STORAGE_URL"), // optional
        containerName: env("STORAGE_CONTAINER_NAME"),
        defaultPath: "assets",
        cdnBaseURL: env("STORAGE_CDN_URL"), // optional
        createContainerIfNotExists: true,
        containerAccessType: 'private'
      },
    },
  },
});
```

| Property | Required | Description |
| -------- | -------- | -------- |
| account | yes | Azure account name |
| accountKey | yes | Secret access key |
| serviceBaseURL  | no     | Base service URL to be used, optional. Defaults to `https://${account}.blob.core.windows.net` |
| containerName  | yes     | Container name |
| defaultPath  | yes     | The path to use when there is none being specified. Defaults to `assets` |
| cdnBaseURL  | no     | CDN base url |
| createContainerIfNotExisits | no | Indicates whether the plugin should create the specified container if it doesn't exist.
| containerAccessType | no | The configured container access type. One of 'private', 'container' or 'blob'. Defaults to 'private'

### Security Middleware Configuration

Due to the default settings in the Strapi Security Middleware you will need to modify the contentSecurityPolicy settings to properly see thumbnail previews in the Media Library. You should replace strapi::security string with the object bellow instead as explained in the middleware configuration documentation.

To allow the azure storage content to be displayed, edit the file at `./config/middlewares.ts`.
You should replace the `strapi::security` string with the object below instead, see the [Middlewares configuration](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/required/middlewares.html) documentation for more details.

`./config/middlewares.ts`

```ts
// This code supposes azurite runs in docker in local on port 10000. Adjust as necessary.
const storageDomain = (process.env.AZURE_STORAGE_ACCOUNT && `${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/`) || 'host.docker.internal:10000'

export default [
  // ...
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": ["'self'", "data:", "blob:", "dl.airtable.com", "market-assets.strapi.io", storageDomain],
          "media-src": ["'self'", "data:", "blob:", "dl.airtable.com", "market-assets.strapi.io", storageDomain],
          upgradeInsecureRequests: null,
        },
      },
    }
  },
  // ...
];

```

`serviceBaseURL` is optional, it is useful when connecting to Azure Storage API compatible services, like the official emulator [Azurite](https://github.com/Azure/Azurite/). `serviceBaseURL` would then look like `http://localhost:10000/your-storage-account`.
When `serviceBaseURL` is not provided, default `https://${account}.blob.core.windows.net` will be used.
When running Azurite in Docker, `serviceBaseURL` should be used with a URL that looks like : `http://host.docker.internal/10000`

`cdnBaseURL` is optional, it is useful when using CDN in front of your storage account. Images will be returned with the CDN URL instead of the storage account URL.

`createContainerIfNotExists` is optional, and defaults to `true`.

`containerAccessType` is optional, and defaults to `'private'`.

## Contributing

Contributions are welcome

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/fperreaultnv/strapi-provider-upload-private-azure-storage/releases).

## Authors

* **Jake Feldman** - *Initial work* - [jakeFeldman](https://github.com/jakeFeldman)

* **Felix Perreault** - *Enhancements* - [fperreaultnv](https://github.com/fperreaultnv)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* strapi.io
* Azure
