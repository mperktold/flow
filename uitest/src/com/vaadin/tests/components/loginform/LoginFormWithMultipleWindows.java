package com.vaadin.tests.components.loginform;

import com.vaadin.Application.LegacyApplication;
import com.vaadin.ui.LoginForm;
import com.vaadin.ui.LoginForm.LoginEvent;
import com.vaadin.ui.LoginForm.LoginListener;
import com.vaadin.ui.UI.LegacyWindow;

@SuppressWarnings("serial")
public class LoginFormWithMultipleWindows extends LegacyApplication {

    @Override
    public void init() {
        setMainWindow(new LoginFormWindow());
    }

    public static class LoginFormWindow extends LegacyWindow {
        public LoginFormWindow() {
            super();

            LoginForm loginForm = new LoginForm();
            loginForm.setSizeUndefined();

            loginForm.addListener(new LoginListener() {

                private static final long serialVersionUID = 1L;

                @Override
                public void onLogin(LoginEvent event) {
                    showNotification(event.getLoginParameter("username") + ":"
                            + event.getLoginParameter("password"));

                }
            });

            addComponent(loginForm);
        }
    }

}
