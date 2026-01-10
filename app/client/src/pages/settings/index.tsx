import { Navigate } from "react-router-dom";

// Default redirect to general settings
const Settings = () => {
  return <Navigate to="/settings/general" replace />;
};

export default Settings;

