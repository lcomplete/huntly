import MainContainer from "../../components/MainContainer";
import FoldersSetting from "../../components/SettingModal/FoldersSetting";

const SettingsFolders = () => {
  return (
    <MainContainer>
      <div className="settings-page-content p-4 max-w-4xl">
        <FoldersSetting />
      </div>
    </MainContainer>
  );
};

export default SettingsFolders;

