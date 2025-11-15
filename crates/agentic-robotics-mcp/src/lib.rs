//! ROS3 Model Context Protocol Integration
//!
//! Provides MCP server capabilities for ROS3

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// MCP tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

/// MCP response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResponse {
    pub content: Vec<McpContent>,
}

/// MCP content type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum McpContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "resource")]
    Resource { uri: String, data: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_tool() {
        let tool = McpTool {
            name: "test".to_string(),
            description: "Test tool".to_string(),
            input_schema: serde_json::json!({}),
        };

        assert_eq!(tool.name, "test");
    }
}
