//! ROS3 Node.js Bindings
//!
//! NAPI bindings for Node.js integration

#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct ROS3Node {
    name: String,
}

#[napi]
impl ROS3Node {
    #[napi(constructor)]
    pub fn new(name: String) -> Self {
        Self { name }
    }

    #[napi]
    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    #[napi]
    pub async fn publish(&self, topic: String, data: String) -> Result<()> {
        // In real implementation, this would use ros3-core
        Ok(())
    }

    #[napi]
    pub fn get_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_creation() {
        let node = ROS3Node::new("test_node".to_string());
        assert_eq!(node.get_name(), "test_node");
    }
}
