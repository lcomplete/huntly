import MainContainer from "../../components/MainContainer";
import { FeedsSetting } from "../../components/SettingModal/FeedsSetting";
import SubHeader from "../../components/SubHeader";
import RssFeedIcon from '@mui/icons-material/RssFeed';
import "../../styles/settings.css";
import { useTranslation } from "react-i18next";

const SettingsFeeds = () => {
  const { t } = useTranslation('settings');

  return (
    <MainContainer>
      <SubHeader
        documentTitle={t('feeds')}
        navLabel={{ labelText: t('feeds'), labelIcon: RssFeedIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <FeedsSetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsFeeds;


