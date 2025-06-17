# File Storage | Convex Developer Hub

File Storage makes it easy to implement file upload in your app, store files from and send files to third-party APIs, and to serve dynamic files to your users. All file types are supported.

- **Upload** files to store them in Convex and reference them in your database documents
- **Store** files generated or fetched from third-party APIs
- **Serve** files via URL
- **Delete** files stored in Convex
- Access file **metadata**

You can manage your stored files on the dashboard.

Examples:
- [File Storage with HTTP Actions](https://github.com/get-convex/convex-demos/tree/main/file-storage-with-http)
- [File Storage with Queries and Mutations](https://github.com/get-convex/convex-demos/tree/main/file-storage)

## Key Concepts

### Storage IDs

Every file stored in Convex has a unique storage ID. This ID is used to reference the file in your database documents and to retrieve the file content.

### Upload URLs

To upload files from clients, you generate temporary upload URLs on the server. These URLs allow secure, direct uploads from the browser or mobile app.

### File Metadata

Each stored file has associated metadata including:
- Content type (MIME type)
- Size in bytes
- Upload timestamp

## Common Patterns

### File Upload Flow

1. Client requests an upload URL from a mutation
2. Server generates and returns a temporary upload URL
3. Client uploads file directly to the URL
4. Client notifies server of successful upload with the storage ID
5. Server stores the storage ID in the database

### Serving Files

Files can be served:
- Via HTTP endpoints for public access
- Through queries that return file URLs
- With proper content type headers for in-browser viewing

### File Management

- Files are automatically garbage collected if not referenced
- You can explicitly delete files when no longer needed
- Files persist across deployments

## Best Practices

- Store file references (storage IDs) in your database documents
- Generate upload URLs only when needed (they expire)
- Validate file types and sizes before accepting uploads
- Use HTTP actions for serving files with custom headers
- Consider CDN integration for frequently accessed files