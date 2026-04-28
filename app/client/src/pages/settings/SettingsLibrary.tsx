import MainContainer from "../../components/MainContainer";
import LibrarySetting from "../../components/SettingModal/LibrarySetting";
import SubHeader from "../../components/SubHeader";
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsLibrary = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('library')}
        navLabel={{ labelText: t('library'), labelIcon: LibraryBooksIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <LibrarySetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsLibrary;


