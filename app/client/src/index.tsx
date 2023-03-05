import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import "./styles/globals.css";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import moment from "moment";
import 'moment/locale/zh-cn'
import {SnackbarProvider} from "notistack";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
    }
  },
});
moment.locale('zh-cn');

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  // <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*<ReactQueryDevtools initialIsOpen={false}/>*/}
      <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
        <App/>
      </SnackbarProvider>
    </QueryClientProvider>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
