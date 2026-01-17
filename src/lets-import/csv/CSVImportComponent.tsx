import React, { useState } from 'react';
import { CSVImportModal, CSVImportConfig } from './CSVImportModal';
import { CSVImporter } from './csvImporter';
import { t } from '@/libs/l10n';

export function CSVImportComponent() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const csvImporter = new CSVImporter();

  const handleImport = async (config: CSVImportConfig) => {
    try {
      const result = await csvImporter.importFromConfig(config);
      
      if (result.failed > 0) {
        orca.notify(
          'warn',
          t('csv.import.error') + `: ${result.success} 成功, ${result.failed} 失败`
        );
      } else {
        orca.notify(
          'success',
          t('csv.import.success') + `: 成功导入 ${result.success} 个块`
        );
      }
      
      setIsModalVisible(false);
    } catch (error) {
      console.error('CSV import failed:', error);
      orca.notify('error', t('csv.import.error'));
      throw error;
    }
  };

  return (
    <>
      <orca.components.Button
        variant="outline"
        onClick={() => setIsModalVisible(true)}
      >
        <i className="ti ti-file-import" />
        {t('csv.import.selectFile')}
      </orca.components.Button>

      <CSVImportModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onImport={handleImport}
      />
    </>
  );
}