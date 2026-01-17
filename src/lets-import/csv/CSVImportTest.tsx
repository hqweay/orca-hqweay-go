import React from 'react';
import { CSVImportComponent } from './CSVImportComponent';
import { t } from "@/libs/l10n";

/**
 * 测试组件，用于验证CSV导入功能
 * 在开发环境中可以使用此组件进行快速测试
 */
export function CSVImportTest() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>{t("csv.import.selectFile")}</h2>
      <p>这是一个测试页面，用于验证CSV导入功能。</p>
      <CSVImportComponent />

      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          background: "#f0f0f0",
          borderRadius: "4px",
        }}
      >
        <h3>测试说明:</h3>
        <ol>
          <li>点击上方的按钮启动CSV导入</li>
          <li>
            选择 <code>sample.csv</code> 文件进行测试
          </li>
          <li>配置导入设置</li>
          <li>观察导入结果</li>
        </ol>

        <h4>推荐配置:</h4>
        <ul>
          <li>块内容列: 选择"名称"列</li>
          <li>标签: 输入"CSV导入,测试"</li>
          <li>
            列映射:
            <ul>
              <li>人员 → 负责人</li>
              <li>代号 → 编号</li>
              <li>标签 → 分类</li>
            </ul>
          </li>
          <li>跳过标题行: 勾选</li>
        </ul>
      </div>
    </div>
  );
}

// 如果需要在开发环境中快速测试，可以取消下面这行的注释
// 在main.ts中使用: React.createElement(CSVImportTest)