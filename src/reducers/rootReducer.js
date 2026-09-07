import { combineReducers } from "redux";
import authControlRdcr from "./authControlRdcr";
import mtrxControlRdcr from "./mtrxControlRdcr";

export default combineReducers({
  mtrxControlRdcr,
  authControlRdcr,
});
