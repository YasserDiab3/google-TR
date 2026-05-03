/**
 * Cloud Storage Integration Service
 * Handles OAuth integration with OneDrive, Google Drive, and SharePoint
 */

const CloudStorageIntegration = {
    /**
     * OAuth 2.0 endpoints for different services
     */
    endpoints: {
        onedrive: {
            auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            api: 'https://graph.microsoft.com/v1.0',
            scope: 'Files.ReadWrite offline_access'
        },
        googleDrive: {
            auth: 'https://accounts.google.com/o/oauth2/v2/auth',
            token: 'https://oauth2.googleapis.com/token',
            api: 'https://www.googleapis.com/drive/v3',
            scope: 'https://www.googleapis.com/auth/drive.file'
        },
        sharepoint: {
            auth: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
            token: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
            api: 'https://graph.microsoft.com/v1.0',
            scope: 'Sites.ReadWrite.All Files.ReadWrite offline_access'
        }
    },

    /**
     * Check if a cloud service is enabled and configured
     */
    isServiceEnabled(service) {
        const config = AppState.cloudStorageConfig[service];
        return config && config.enabled && config.clientId && config.accessToken;
    },

    /**
     * Check if access token is valid (not expired)
     */
    isTokenValid(service) {
        const config = AppState.cloudStorageConfig[service];
        if (!config || !config.accessToken || !config.tokenExpiry) {
            return false;
        }
        const expiry = new Date(config.tokenExpiry);
        const now = new Date();
        // Check if token expires in more than 5 minutes
        return expiry > new Date(now.getTime() + 5 * 60 * 1000);
    },

    /**
     * Get redirect URI for OAuth callback
     */
    getRedirectUri() {
        return window.location.origin + window.location.pathname;
    },

    /**
     * Initiate OAuth flow for a service
     */
    async authorize(service) {
        if (!AppState.cloudStorageConfig[service]) {
            Notification.error(`الخدمة ${service} غير مفعّلة أو غير مُكوّنة`);
            return;
        }

        const config = AppState.cloudStorageConfig[service];
        const endpoint = this.endpoints[service];
        const redirectUri = encodeURIComponent(this.getRedirectUri());
        const state = Utils.generateId('CS');
        
        // Store state for verification
        sessionStorage.setItem('cloud_storage_oauth_state', state);

        let authUrl = '';
        if (service === 'onedrive') {
            authUrl = `${endpoint.auth}?client_id=${config.clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${encodeURIComponent(endpoint.scope)}&state=${state}`;
        } else if (service === 'googleDrive') {
            authUrl = `${endpoint.auth}?client_id=${config.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(endpoint.scope)}&access_type=offline&prompt=consent&state=${state}`;
        } else if (service === 'sharepoint') {
            const tenantId = config.tenantId || 'common';
            const authEndpoint = endpoint.auth.replace('{tenant}', tenantId);
            authUrl = `${authEndpoint}?client_id=${config.clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${encodeURIComponent(endpoint.scope)}&state=${state}`;
        }

        // Open OAuth window
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        const popup = window.open(
            authUrl,
            'cloud_storage_oauth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for OAuth callback
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                try {
                    if (popup.closed) {
                        clearInterval(checkInterval);
                        clearTimeout(timeout);
                        reject(new Error('تم إغلاق نافذة المصادقة'));
                    }
                    
                    // Check if popup redirected to our callback
                    if (popup.location && popup.location.origin === window.location.origin) {
                        const urlParams = new URLSearchParams(popup.location.search);
                        const code = urlParams.get('code');
                        const state = urlParams.get('state');
                        const error = urlParams.get('error');

                        if (error) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            popup.close();
                            reject(new Error(`فشل المصادقة: ${error}`));
                            return;
                        }

                        if (code && state === sessionStorage.getItem('cloud_storage_oauth_state')) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            popup.close();
                            sessionStorage.removeItem('cloud_storage_oauth_state');
                            
                            // Exchange code for token
                            this.exchangeCodeForToken(service, code)
                                .then(resolve)
                                .catch(reject);
                        }
                    }
                } catch (e) {
                    // Cross-origin error, ignore
                }
            }, 100);

            const timeout = setTimeout(() => {
                clearInterval(checkInterval);
                popup.close();
                reject(new Error('انتهت مهلة المصادقة'));
            }, 5 * 60 * 1000); // 5 minutes timeout
        });
    },

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(service, code) {
        const config = AppState.cloudStorageConfig[service];
        const endpoint = this.endpoints[service];
        const redirectUri = this.getRedirectUri();

        let tokenUrl = '';
        let body = '';

        if (service === 'onedrive' || service === 'sharepoint') {
            tokenUrl = service === 'sharepoint' 
                ? endpoint.token.replace('{tenant}', config.tenantId || 'common')
                : endpoint.token;
            
            body = new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: endpoint.scope
            });
        } else if (service === 'googleDrive') {
            tokenUrl = endpoint.token;
            body = new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            });
        }

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`فشل الحصول على رمز الوصول: ${error}`);
            }

            const data = await response.json();
            
            // Save tokens
            config.accessToken = data.access_token;
            config.refreshToken = data.refresh_token || config.refreshToken;
            config.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

            // Save configuration
            DataManager.saveCloudStorageConfig();
            
            // Log activity
            AuditLog.log('cloud_storage_connected', 'CloudStorage', service, {
                service: service,
                status: 'success'
            });

            await UserActivityLog.log('settings', 'CloudStorage', null, {
                action: 'cloud_storage_connected',
                service: service
            });

            Notification.success(`تم ربط الخدمة ${this.getServiceName(service)} بنجاح`);
            return data;
        } catch (error) {
            Utils.safeError('Error exchanging code for token:', error);
            AuditLog.log('cloud_storage_connection_failed', 'CloudStorage', service, {
                service: service,
                error: error.message
            });
            throw error;
        }
    },

    /**
     * Refresh access token
     */
    async refreshToken(service) {
        const config = AppState.cloudStorageConfig[service];
        if (!config || !config.refreshToken) {
            throw new Error('لا يوجد رمز تحديث للخدمة');
        }

        const endpoint = this.endpoints[service];
        const redirectUri = this.getRedirectUri();

        let tokenUrl = '';
        let body = '';

        if (service === 'onedrive' || service === 'sharepoint') {
            tokenUrl = service === 'sharepoint'
                ? endpoint.token.replace('{tenant}', config.tenantId || 'common')
                : endpoint.token;
            
            body = new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: config.refreshToken,
                redirect_uri: redirectUri,
                grant_type: 'refresh_token',
                scope: endpoint.scope
            });
        } else if (service === 'googleDrive') {
            tokenUrl = endpoint.token;
            body = new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: config.refreshToken,
                grant_type: 'refresh_token'
            });
        }

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });

            if (!response.ok) {
                throw new Error('فشل تحديث رمز الوصول');
            }

            const data = await response.json();
            config.accessToken = data.access_token;
            config.refreshToken = data.refresh_token || config.refreshToken;
            config.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

            DataManager.saveCloudStorageConfig();
            return data;
        } catch (error) {
            Utils.safeError('Error refreshing token:', error);
            throw error;
        }
    },

    /**
     * Ensure valid access token
     */
    async ensureValidToken(service) {
        if (!this.isTokenValid(service)) {
            await this.refreshToken(service);
        }
        return AppState.cloudStorageConfig[service].accessToken;
    },

    /**
     * Upload file to cloud storage
     */
    async uploadFile(service, file, fileName, folderPath = '') {
        if (!this.isServiceEnabled(service)) {
            throw new Error(`الخدمة ${this.getServiceName(service)} غير مفعّلة أو غير مُكوّنة`);
        }

        // التحقق من صحة الملف
        try {
            await Utils.FileValidator.validateFile(file);
        } catch (validationError) {
            throw new Error(`فشل التحقق من صحة الملف: ${validationError.message}`);
        }

        Loading.show(`جاري رفع الملف إلى ${this.getServiceName(service)}...`);

        try {
            const accessToken = await this.ensureValidToken(service);
            let fileId = '';
            let fileUrl = '';

            if (service === 'onedrive') {
                const result = await this.uploadToOneDrive(accessToken, file, fileName, folderPath);
                fileId = result.id;
                fileUrl = result.webUrl || result.webDavUrl;
            } else if (service === 'googleDrive') {
                const result = await this.uploadToGoogleDrive(accessToken, file, fileName, folderPath);
                fileId = result.id;
                fileUrl = `https://drive.google.com/file/d/${result.id}/view`;
            } else if (service === 'sharepoint') {
                const config = AppState.cloudStorageConfig.sharepoint;
                const result = await this.uploadToSharePoint(accessToken, config.siteUrl, file, fileName, folderPath);
                fileId = result.id;
                fileUrl = result.webUrl || result.webDavUrl;
            }

            // Log activity
            AuditLog.log('cloud_storage_upload', 'CloudStorage', fileId, {
                service: service,
                fileName: fileName,
                fileSize: file.size,
                status: 'success'
            });

            await UserActivityLog.log('upload', 'CloudStorage', fileId, {
                action: 'cloud_storage_upload',
                service: service,
                fileName: fileName
            });

            Loading.hide();
            return {
                id: fileId,
                url: fileUrl,
                service: service,
                fileName: fileName,
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            Loading.hide();
            // قمع الأخطاء في بيئة الإنتاج
            const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
            if (!isProduction) {
                Utils.safeError('Error uploading file:', error);
            }
            AuditLog.log('cloud_storage_upload_failed', 'CloudStorage', null, {
                service: service,
                fileName: fileName,
                error: error.message
            });
            // إرجاع رسالة خطأ واضحة للمستخدم
            const userMessage = error.message.includes('غير مفعّلة') 
                ? error.message 
                : 'فشل رفع الملف. يرجى التحقق من الاتصال بالإنترنت وإعدادات التخزين السحابي.';
            throw new Error(userMessage);
        }
    },

    /**
     * Upload file to OneDrive
     */
    async uploadToOneDrive(accessToken, file, fileName, folderPath) {
        const endpoint = this.endpoints.onedrive.api;
        const path = folderPath ? `/me/drive/root:/${folderPath}/${fileName}:/content` : `/me/drive/root:/${fileName}:/content`;

        const response = await fetch(`${endpoint}${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`فشل رفع الملف إلى OneDrive: ${error}`);
        }

        const data = await response.json();
        
        // Get file metadata with web URL
        const metadataResponse = await fetch(`${endpoint}/me/drive/items/${data.id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            return {
                id: data.id,
                webUrl: metadata.webUrl,
                webDavUrl: metadata.webDavUrl
            };
        }

        return data;
    },

    /**
     * Upload file to Google Drive
     */
    async uploadToGoogleDrive(accessToken, file, fileName, folderPath) {
        const endpoint = this.endpoints.googleDrive.api;
        
        // Create metadata
        const metadata = {
            name: fileName,
            mimeType: file.type || 'application/octet-stream'
        };

        // If folder path is specified, we'd need to resolve folder ID
        // For simplicity, we'll upload to root
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file);

        const response = await fetch(`${endpoint}/files?uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`فشل رفع الملف إلى Google Drive: ${error}`);
        }       

        return await response.json();
    },

    /**
     * Upload file to SharePoint
     */
    async uploadToSharePoint(accessToken, siteUrl, file, fileName, folderPath) {
        const endpoint = this.endpoints.sharepoint.api;
        
        // Extract site ID from siteUrl
        let siteId = '';
        try {
            const siteResponse = await fetch(`${endpoint}/sites/${siteUrl.replace('https://', '').replace('http://', '')}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (siteResponse.ok) {
                const siteData = await siteResponse.json();
                siteId = siteData.id;
            }
        } catch (e) {
            // Fallback: use siteUrl as-is
        }

        const path = folderPath 
            ? `/sites/${siteId || siteUrl}/drive/root:/${folderPath}/${fileName}:/content`
            : `/sites/${siteId || siteUrl}/drive/root:/${fileName}:/content`;

        const response = await fetch(`${endpoint}${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`فشل رفع الملف إلى SharePoint: ${error}`);
        }

        const data = await response.json();
        
        // Get file metadata with web URL
        const metadataResponse = await fetch(`${endpoint}/sites/${siteId || siteUrl}/drive/items/${data.id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            return {
                id: data.id,
                webUrl: metadata.webUrl,
                webDavUrl: metadata.webDavUrl
            };
        }

        return data;
    },

    /**
     * Download file from cloud storage
     */
    async downloadFile(cloudLink) {
        if (!cloudLink || !cloudLink.service || !cloudLink.id) {
            throw new Error('فشل تحميل الملف من التخزين السحابي');
        }

        Loading.show(`تحميل الملف من ${this.getServiceName(cloudLink.service)}...`);

        try {
            const accessToken = await this.ensureValidToken(cloudLink.service);
            let downloadUrl = '';

            if (cloudLink.service === 'onedrive') {
                downloadUrl = `${this.endpoints.onedrive.api}/me/drive/items/${cloudLink.id}/content`;
            } else if (cloudLink.service === 'googleDrive') {
                downloadUrl = `${this.endpoints.googleDrive.api}/files/${cloudLink.id}?alt=media`;
            } else if (cloudLink.service === 'sharepoint') {
                const config = AppState.cloudStorageConfig.sharepoint;
                downloadUrl = `${this.endpoints.sharepoint.api}/sites/${config.siteUrl}/drive/items/${cloudLink.id}/content`;
            }

            const response = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error('فشل تحميل الملف من التخزين السحابي.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = cloudLink.fileName || 'file';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Log activity
            AuditLog.log('cloud_storage_download', 'CloudStorage', cloudLink.id, {
                service: cloudLink.service,
                fileName: cloudLink.fileName,
                status: 'success'
            });

            await UserActivityLog.log('download', 'CloudStorage', cloudLink.id, {
                action: 'cloud_storage_download',
                service: cloudLink.service,
                fileName: cloudLink.fileName
            });

            Loading.hide();
            return blob;
        } catch (error) {
            Loading.hide();
            Utils.safeError('Error downloading file:', error);
            AuditLog.log('cloud_storage_download_failed', 'CloudStorage', cloudLink.id, {
                service: cloudLink.service,
                error: error.message
            });
            throw error;
        }
    },

    /**
     * Get service display name
     */
    getServiceName(service) {
        const names = {
            onedrive: 'Microsoft OneDrive',
            googleDrive: 'Google Drive',
            sharepoint: 'Microsoft SharePoint'
        };
        return names[service] || service;
    },

    /**
     * Get available services that are enabled
     */
    getAvailableServices() {
        const services = ['onedrive', 'googleDrive', 'sharepoint'];
        return services.filter(service => this.isServiceEnabled(service));
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.CloudStorageIntegration = CloudStorageIntegration;
}

