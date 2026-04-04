/**
 * v1.0.3: 独立的视图配置管理器，替代 Bases 插件的 config 系统
 */

export interface ViewConfigOptions {
    groupByProperty?: string;
    [key: string]: any;
}

export class ViewConfig {
    private config: ViewConfigOptions = {};

    constructor(initialConfig: ViewConfigOptions = {}) {
        this.config = { ...initialConfig };
    }

    /**
     * 获取属性值
     */
    getProperty(key: string): any {
        return this.config[key];
    }

    /**
     * 获取属性 ID（兼容 Bases 的 getAsPropertyId 方法）
     */
    getAsPropertyId(key: string): string | undefined {
        return this.config[key];
    }

    /**
     * 设置属性值
     */
    setProperty(key: string, value: any): void {
        this.config[key] = value;
    }

    /**
     * 获取所有配置
     */
    getAll(): ViewConfigOptions {
        return { ...this.config };
    }

    /**
     * 批量更新配置
     */
    update(newConfig: ViewConfigOptions): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 重置配置
     */
    reset(): void {
        this.config = {};
    }
}
