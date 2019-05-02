/*
 * Copyright 2000-2018 Vaadin Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

package com.vaadin.flow.server.frontend;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

import com.vaadin.flow.server.Command;

import static com.vaadin.flow.server.frontend.FrontendUtils.WEBPACK_CONFIG;

/**
 * Updates the webpack config file according with current project settings.
 */
public class WebpackUpdater implements Command {

    /**
     * The name of the webpack config file.
     */
    private final String webpackTemplate;
    private final transient Path webpackOutputDirectory;
    private final transient Path generatedFlowImports;
    private final transient Path webpackConfigFolder;

    /**
     * Create an instance of the updater given all configurable parameters.
     *
     * @param webpackConfigFolder
     *            folder with the `webpack.config.js` file.
     * @param webpackOutputDirectory
     *            the directory to set for webpack to output its build results.
     * @param webpackTemplate
     *            name of the webpack resource to be used as template when
     *            creating the <code>webpack.config.js</code> file.
     * @param generatedFlowImports
     *            name of the JS file to update with the Flow project imports
     */
    public WebpackUpdater(File webpackConfigFolder, File webpackOutputDirectory,
            String webpackTemplate, File generatedFlowImports) {
        this.webpackTemplate = webpackTemplate;
        this.webpackOutputDirectory = webpackOutputDirectory.toPath();
        this.generatedFlowImports = generatedFlowImports.toPath();
        this.webpackConfigFolder = webpackConfigFolder.toPath();
    }

    @Override
    public void execute() {
        try {
            createWebpackConfig();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void createWebpackConfig() throws IOException {
        if (webpackTemplate == null || webpackTemplate.trim().isEmpty()) {
            return;
        }

        File configFile = new File(webpackConfigFolder.toFile(),
                WEBPACK_CONFIG);

        if (configFile.exists()) {
            NodeUpdater.log().info("{} already exists.", configFile);
        } else {
            URL resource = this.getClass().getClassLoader()
                    .getResource(webpackTemplate);
            if (resource == null) {
                resource = new URL(webpackTemplate);
            }

            try (BufferedReader br = new BufferedReader(new InputStreamReader(
                    resource.openStream(), StandardCharsets.UTF_8))) {
                List<String> webpackConfigLines = br.lines()
                        .map(line -> line.replace("{{OUTPUT_DIRECTORY}}",
                                getEscapedRelativeWebpackPath(
                                        webpackOutputDirectory)))
                        .map(line -> line.replace("{{GENERATED_FLOW_IMPORTS}}",
                                getEscapedRelativeWebpackPath(
                                        generatedFlowImports)))
                        .collect(Collectors.toList());
                Files.write(configFile.toPath(), webpackConfigLines);
                NodeUpdater.log().info("Created {} from {}", WEBPACK_CONFIG,
                        resource);
            }
        }
    }

    private String getEscapedRelativeWebpackPath(Path path) {
        Path relativePath = path.isAbsolute()
                ? webpackConfigFolder.relativize(path)
                : path;
        return relativePath.toString().replaceAll("\\\\", "/");
    }
}