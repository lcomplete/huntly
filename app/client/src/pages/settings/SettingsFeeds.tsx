import MainContainer from "../../components/MainContainer";
import { FeedsSetting } from "../../components/SettingModal/FeedsSetting";

const SettingsFeeds = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <FeedsSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsFeeds;

