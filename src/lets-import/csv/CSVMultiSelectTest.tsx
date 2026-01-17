import React, { useState } from 'react';
import { CSVImporter, PropType } from './csvImporter';

export default function CSVMultiSelectTest() {
  const [testResults, setTestResults] = useState<string>('');

  // 模拟测试数据
  const testData = {
    '电影名称': '流浪地球',
    '导演': '郭帆',
    '年份': '2019',
    '类型': '科幻 灾难',
    '主演': '吴京 屈楚萧'
  };

  const testMappings = { 
    1: '导演', 
    3: '类型',  // 多选属性测试
    4: '主演'   // 多选属性测试
  };

  const testMultiSelectParsing = () => {
    try {
      const importer = new CSVImporter();
      
      // 测试标签数据创建
      const tagData = importer.createTagDataFromMappings(testData, testMappings, {
        3: PropType.TextChoices,  // 类型列设为多选
        4: PropType.TextChoices   // 主演列设为多选
      });
      
      let results = '多选属性测试结果:\n\n';
      results += '测试数据:\n';
      results += JSON.stringify(testData, null, 2) + '\n\n';
      
      results += '列映射:\n';
      results += JSON.stringify(testMappings, null, 2) + '\n\n';
      
      results += '生成的标签数据:\n';
      results += JSON.stringify(tagData, null, 2) + '\n\n';
      
      // 检查多选属性
      const multiChoiceProps = tagData.filter(prop => prop.type === PropType.TextChoices);
      const singleChoiceProps = tagData.filter(prop => prop.type === PropType.Text);
      
      results += `检测到的多选属性数量: ${multiChoiceProps.length}\n`;
      results += `检测到的单选属性数量: ${singleChoiceProps.length}\n`;
      
      if (multiChoiceProps.length > 0) {
        results += '\n多选属性详情:\n';
        multiChoiceProps.forEach((prop, index) => {
          results += `${index + 1}. ${prop.name}:\n`;
          results += `   - 值: ${JSON.stringify(prop.value)}\n`;
          results += `   - 类型: ${prop.type} (PropType.TextChoices)\n`;
          results += `   - 数组长度: ${prop.value.length}\n`;
          results += `   - 数组内容: [${prop.value.map((v: string) => `"${v}"`).join(', ')}]\n\n`;
        });
      }
      
      if (singleChoiceProps.length > 0) {
        results += '单选属性详情:\n';
        singleChoiceProps.forEach((prop, index) => {
          results += `${index + 1}. ${prop.name}: "${prop.value}" (类型: ${prop.type})\n`;
        });
      }
      
      // 验证预期结果
      results += '\n验证结果:\n';
      const expectedMultiChoice = ['类型', '主演'];
      const actualMultiChoice = multiChoiceProps.map(prop => prop.name);
      
      if (JSON.stringify(expectedMultiChoice.sort()) === JSON.stringify(actualMultiChoice.sort())) {
        results += '✅ 多选属性识别正确\n';
      } else {
        results += '❌ 多选属性识别错误\n';
        results += `   期望: ${expectedMultiChoice.join(', ')}\n`;
        results += `   实际: ${actualMultiChoice.join(', ')}\n`;
      }
      
      // 验证分号分隔
      const genreProp = multiChoiceProps.find(prop => prop.name === '类型');
      const actorProp = multiChoiceProps.find(prop => prop.name === '主演');
      
      if (genreProp && genreProp.value.length === 2 &&
          genreProp.value.includes('科幻') && genreProp.value.includes('灾难')) {
        results += '✅ 类型字段空格分隔正确\n';
      } else {
        results += '❌ 类型字段空格分隔错误\n';
      }
      
      if (actorProp && actorProp.value.length === 2 &&
          actorProp.value.includes('吴京') && actorProp.value.includes('屈楚萧')) {
        results += '✅ 主演字段空格分隔正确\n';
      } else {
        results += '❌ 主演字段空格分隔错误\n';
      }
      
      setTestResults(results);
    } catch (error) {
      setTestResults(`测试失败: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>CSV多选属性测试</h2>
      
      <button 
        onClick={testMultiSelectParsing}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007cba',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        运行多选属性测试
      </button>
      
      {testResults && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f5f5f5', 
          border: '1px solid #ddd',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <h3>测试结果:</h3>
          {testResults}
        </div>
      )}
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
        <h3>测试说明:</h3>
        <ul>
          <li><strong>多选属性识别</strong>: 用户可以选择属性类型，支持文本和多选</li>
          <li><strong>空格分隔</strong>: 多选属性使用空格作为分隔符</li>
          <li><strong>PropType分配</strong>: 多选属性使用PropType.TextChoices(6)，单选属性使用PropType.Text(1)</li>
          <li><strong>数组值处理</strong>: 多选属性的值存储为字符串数组</li>
          <li><strong>预期行为</strong>: "类型"和"主演"列应被识别为多选属性</li>
          <li><strong>测试数据</strong>: "科幻 灾难" 应分解为 ["科幻", "灾难"]</li>
        </ul>
        
        <h4>使用示例CSV:</h4>
        <p>可以使用 <code>test-multiselect.csv</code> 文件来测试实际的CSV导入功能。</p>
      </div>
    </div>
  );
}