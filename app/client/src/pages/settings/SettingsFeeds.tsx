import MainContainer from "../../components/MainContainer";
import { FeedsSetting } from "../../components/SettingModal/FeedsSetting";
import SubHeader from "../../components/SubHeader";
import RssFeedIcon from '@mui/icons-material/RssFeed';

const SettingsFeeds = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{labelText: 'Feeds', labelIcon: RssFeedIcon}}
        buttonOptions={{markRead: false}}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <FeedsSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsFeeds;

