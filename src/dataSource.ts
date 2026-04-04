import { App, TFile, CachedMetadata } from "obsidian";

/**
 * v1.0.3: 独立的数据源系统，替代 Bases 插件的数据筛选功能
 */

export interface FileEntry {
    file: TFile;
    metadata: CachedMetadata | null;
    getValue: (property: string) => any;
}

export interface DataSourceConfig {
    folder?: string;           // 文件夹路径筛选
    tag?: string;              // 标签筛选
    properties?: Record<string, any>;  // 属性筛选
}

export class DataSource {
    constructor(private app: App) {}

    /**
     * 获取所有符合条件的文件
     */
    async getFiles(config: DataSourceConfig = {}): Promise<FileEntry[]> {
        const allFiles = this.app.vault.getMarkdownFiles();
        const entries: FileEntry[] = [];

        for (const file of allFiles) {
            // 文件夹筛选
            if (config.folder && !file.path.startsWith(config.folder)) {
                continue;
            }

            const metadata = this.app.metadataCache.getFileCache(file);

            // 标签筛选
            if (config.tag) {
                const tags = this.getAllTags(metadata);
                if (!tags.includes(config.tag)) {
                    continue;
                }
            }

            // 属性筛选
            if (config.properties) {
                const frontmatter = metadata?.frontmatter;
                let match = true;

                for (const [key, value] of Object.entries(config.properties)) {
                    if (frontmatter?.[key] !== value) {
                        match = false;
                        break;
                    }
                }

                if (!match) continue;
            }

            entries.push({
                file,
                metadata,
                getValue: (property: string) => this.getPropertyValue(file, metadata, property)
            });
        }

        return entries;
    }

    /**
     * 获取文件的属性值
     */
    private getPropertyValue(file: TFile, metadata: CachedMetadata | null, property: string): any {
        // 处理特殊属性
        if (property === "file.name") return file.basename;
        if (property === "file.path") return file.path;
        if (property === "file.folder") return file.parent?.path || "";
        if (property === "file.ctime") return file.stat.ctime;
        if (property === "file.mtime") return file.stat.mtime;
        if (property === "file.size") return file.stat.size;

        // 从 frontmatter 获取
        return metadata?.frontmatter?.[property];
    }

    /**
     * 获取文件的所有标签
     */
    private getAllTags(metadata: CachedMetadata | null): string[] {
        const tags: string[] = [];

        // frontmatter 标签
        if (metadata?.frontmatter?.tags) {
            const fmTags = metadata.frontmatter.tags;
            if (Array.isArray(fmTags)) {
                tags.push(...fmTags);
            } else if (typeof fmTags === 'string') {
                tags.push(fmTags);
            }
        }

        // 内容中的标签
        if (metadata?.tags) {
            tags.push(...metadata.tags.map(t => t.tag));
        }

        return tags;
    }

    /**
     * 监听文件变化
     */
    onFileChange(callback: () => void): () => void {
        const metadataRef = this.app.metadataCache.on('changed', callback);
        const createRef = this.app.vault.on('create', callback);
        const deleteRef = this.app.vault.on('delete', callback);
        const renameRef = this.app.vault.on('rename', callback);

        return () => {
            this.app.metadataCache.offref(metadataRef);
            this.app.vault.offref(createRef);
            this.app.vault.offref(deleteRef);
            this.app.vault.offref(renameRef);
        };
    }
}
