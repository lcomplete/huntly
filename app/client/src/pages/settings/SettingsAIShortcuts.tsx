import MainContainer from "../../components/MainContainer";
import ArticleShortcutSetting from "../../components/SettingModal/ArticleShortcutSetting";

const SettingsAIShortcuts = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <ArticleShortcutSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsAIShortcuts;

